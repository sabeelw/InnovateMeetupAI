/**
 * This is the main entry point for the agent.
 * It defines the workflow graph, state, tools, nodes and edges.
 */

import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { getRetriever } from "./retriever";
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { createRetrieverTool } from "langchain/tools/retriever";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, isHumanMessage, isToolMessage } from "@langchain/core/messages";
import { gradeDocumentsSchema } from "./types";
import { generatePrompt, gradingPrompt, rewritePrompt } from "./prompts";
import { CopilotKitStateAnnotation } from "@copilotkit/sdk-js/langgraph";

const llmModel = "gpt-4o";
const MAX_RETRIES = 2;

// 1. Define our agent state, which includes CopilotKit state to
//    provide actions to the state.
const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec,
  retryCount: Annotation<number>({
    reducer: (state, update) => update ?? state,
    default: () => 0,
  }),
});

// 2. Define the type for our agent state
export type AgentState = typeof AgentStateAnnotation.State;

// Create an async initialization function
async function createGraph() {
  try {
    // Wait for the retriever to be initialized
    const retriever = await getRetriever();

    const tool = createRetrieverTool(
      retriever,
      {
        name: "retrieve_harry_potter_info",
        description:
          "Search and return information about Harry Potter books, characters, and themes etc.",
      },
    );
    const tools = [tool];

    // LangGraph Nodes for Innovate Meetup RAG App
    async function generateQueryOrRespond(state: AgentState) {
      try {
        const { messages } = state;

        if (!messages || messages.length === 0) {
          throw new Error("No messages in state");
        }

        const model = new ChatOpenAI({
          model: llmModel,
          temperature: 0,
        }).bindTools(tools);

        const response = await model.invoke(messages);
        return {
          messages: [response],
        };
      } catch (error) {
        console.error("Error in generateQueryOrRespond:", error);
        return {
          messages: [new AIMessage("I encountered an error processing your request. Please try again.")],
        };
      }
    }

    async function gradeDocuments(state: AgentState) {
      try {
        const { messages, retryCount = 0 } = state;

        // If we've retried too many times, just generate with what we have
        if (retryCount >= MAX_RETRIES) {
          console.warn(`Max retries (${MAX_RETRIES}) reached, proceeding to generate`);
          return {
            messages: [new AIMessage("generate")],
            retryCount,
          };
        }

        const question = messages.filter(m => isHumanMessage(m)).at(-1)?.content;
        const context = messages.filter(m => isToolMessage(m)).at(-1)?.content;

        if (!question || !context) {
          console.warn("Missing question or context, proceeding to generate");
          return {
            messages: [new AIMessage("generate")],
            retryCount,
          };
        }

        const model = new ChatOpenAI({
          model: llmModel,
          temperature: 0,
        }).withStructuredOutput(gradeDocumentsSchema, { name: "gradeDocuments" });

        const score = await gradingPrompt.pipe(model).invoke({
          question,
          context,
        });

        const decision = score.binaryScore === true ? "generate" : "rewrite";

        return {
          messages: [new AIMessage(decision)],
          retryCount: decision === "rewrite" ? retryCount + 1 : retryCount,
        };
      } catch (error) {
        console.error("Error in gradeDocuments:", error);
        // On error, proceed to generate with available context
        return {
          messages: [new AIMessage("generate")],
          retryCount: state.retryCount ?? 0,
        };
      }
    }

    async function rewrite(state: AgentState) {
      try {
        const { messages, retryCount = 0 } = state;
        // Get the last human message (most recent user query)
        const lastHumanMessage = messages.filter(m => isHumanMessage(m)).at(-1);
        const question = lastHumanMessage?.content;

        if (!question) {
          throw new Error("No question found to rewrite");
        }

        console.log(`Rewriting query (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        const model = new ChatOpenAI({
          model: llmModel,
          temperature: 0.3, // Slightly higher temperature for query variation
        });

        const response = await rewritePrompt.pipe(model).invoke({ question });
        return {
          messages: [response],
          retryCount,
        };
      } catch (error) {
        console.error("Error in rewrite:", error);
        // Return original question if rewrite fails
        const { messages } = state;
        return {
          messages: [messages.at(0) ?? new AIMessage("Tell me about Harry Potter")],
          retryCount: state.retryCount ?? 0,
        };
      }
    }

    async function generate(state: AgentState) {
      try {
        const { messages } = state;
        const question = messages.filter(m => isHumanMessage(m)).at(-1)?.content ?? "Tell me about Harry Potter";
        const context = messages.filter(m => isToolMessage(m)).at(-1)?.content ?? "No context available";

        if (!question) {
          throw new Error("No question found for generation");
        }

        const llm = new ChatOpenAI({
          model: llmModel,
          temperature: 0.4, // Slightly higher for more natural responses
        });

        const ragChain = generatePrompt.pipe(llm);

        const response = await ragChain.invoke({
          context,
          question,
        });

        return {
          messages: [response],
          retryCount: 0, // Reset retry count after successful generation
        };
      } catch (error) {
        console.error("Error in generate:", error);
        return {
          messages: [new AIMessage("I apologize, but I encountered an error generating a response. Please try asking your question again.")],
          retryCount: 0,
        };
      }
    }

    function shouldRetrieve(state: AgentState) {
      try {
        const { messages } = state;
        const lastMessage = messages.at(-1);

        if (lastMessage && "tool_calls" in lastMessage && Array.isArray((lastMessage as any).tool_calls) && (lastMessage as any).tool_calls.length > 0) {
          return "retrieve";
        }
        return END;
      } catch (error) {
        console.error("Error in shouldRetrieve:", error);
        return END;
      }
    }

    const toolNode = new ToolNode(tools);

    // Define the graph
    const builder = new StateGraph(AgentStateAnnotation)
      .addNode("generateQueryOrRespond", generateQueryOrRespond)
      .addNode("retrieve", toolNode)
      .addNode("gradeDocuments", gradeDocuments)
      .addNode("rewrite", rewrite)
      .addNode("generate", generate)
      // Add edges
      .addEdge(START, "generateQueryOrRespond")
      // Decide whether to retrieve
      .addConditionalEdges("generateQueryOrRespond", shouldRetrieve)
      .addEdge("retrieve", "gradeDocuments")
      // Edges taken after grading documents
      .addConditionalEdges(
        "gradeDocuments",
        // Route based on grading decision
        (state) => {
          const lastMessage = state.messages.at(-1);
          if (lastMessage && lastMessage.content === "generate") {
            return "generate";
          }
          return "rewrite";
        }
      )
      .addEdge("generate", END)
      .addEdge("rewrite", "generateQueryOrRespond");

    // Compile
    const memory = new MemorySaver();
    return builder.compile({ checkpointer: memory });
  } catch (error) {
    console.error("Failed to create graph:", error);
    throw new Error(`Graph initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Cache the graph instance to avoid recreating it
let graphInstance: Awaited<ReturnType<typeof createGraph>> | null = null;
let graphInitPromise: Promise<Awaited<ReturnType<typeof createGraph>>> | null = null;

/**
 * Get the initialized graph instance.
 * This function ensures the graph is only created once and reused.
 */
export async function getGraph() {
  if (graphInstance) {
    return graphInstance;
  }

  if (!graphInitPromise) {
    graphInitPromise = createGraph();
  }

  try {
    graphInstance = await graphInitPromise;
    return graphInstance;
  } catch (error) {
    // Reset promise on error so it can be retried
    graphInitPromise = null;
    throw error;
  }
}

// For backwards compatibility, export a promise
export const graph = getGraph();