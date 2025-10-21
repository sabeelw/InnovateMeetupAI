/**
 * This is the main entry point for the agent.
 * It defines a simplified RAG workflow with two paths:
 * 1. Chit-chat path: For greetings and general Harry Potter conversation
 * 2. Retrieval path: For specific Harry Potter queries
 */

import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { getRetriever } from "./retriever";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, isHumanMessage } from "@langchain/core/messages";
import { routerSchema } from "./types";
import { chitChatPrompt, generatePrompt, routerPrompt } from "./prompts";
import { CopilotKitStateAnnotation } from "@copilotkit/sdk-js/langgraph";

const llmModel = "gpt-4o";

// 1. Define our agent state
const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec,
});

// 2. Define the type for our agent state
export type AgentState = typeof AgentStateAnnotation.State;

// Create an async initialization function
async function createGraph() {
  try {
    // Wait for the retriever to be initialized
    const retriever = await getRetriever();

    // Node 1: Router - Decides between chit-chat and retrieval
    async function router(state: AgentState) {
      try {
        const { messages } = state;

        if (!messages || messages.length === 0) {
          throw new Error("No messages in state");
        }

        const lastMessage = messages.at(-1);
        const question = typeof lastMessage?.content === 'string' ? lastMessage.content : "";

        const model = new ChatOpenAI({
          model: llmModel,
          temperature: 0,
        }).withStructuredOutput(routerSchema);

        const response = await routerPrompt.pipe(model).invoke({
          question,
        });

        console.log("Router decision:", response.path);
        return {
          messages: state.messages,
        };
      } catch (error) {
        console.error("Error in router:", error);
        return {
          messages: state.messages,
        };
      }
    }

    // Node 2: Chit-chat - Handles greetings and general Harry Potter conversation
    async function chitChat(state: AgentState) {
      try {
        const { messages } = state;
        const lastMessage = messages.filter(m => isHumanMessage(m)).at(-1);
        const question = typeof lastMessage?.content === 'string' ? lastMessage.content : "";

        const llm = new ChatOpenAI({
          model: llmModel,
          temperature: 0.7, // Higher temperature for more natural conversation
        });

        const response = await chitChatPrompt.pipe(llm).invoke({
          question,
        });

        return {
          messages: [response],
        };
      } catch (error) {
        console.error("Error in chitChat:", error);
        return {
          messages: [new AIMessage("Hello! How can I help you with Harry Potter today?")],
        };
      }
    }

    // Routing function - Decides which path to take after router
    async function generate(state: AgentState) {
      try {
        const { messages } = state;
        const lastMessage = messages.filter(m => isHumanMessage(m)).at(-1);
        const question = typeof lastMessage?.content === 'string' ? lastMessage.content : "";

        // Get retrieved context
        const docs = await retriever.invoke(question);
        const context = docs.map(doc => doc.pageContent).join("\n\n");

        const llm = new ChatOpenAI({
          model: llmModel,
          temperature: 0.4,
        });

        const response = await generatePrompt.pipe(llm).invoke({
          context,
          question,
        });

        return {
          messages: [response],
        };
      } catch (error) {
        console.error("Error in generate:", error);
        return {
          messages: [new AIMessage("I apologize, but I encountered an error generating a response. Please try asking your question again.")],
        };
      }
    }

    // Routing function - Decides which path to take after router
    async function decideRoute(state: AgentState): Promise<"chitChat" | "generate"> {
      try {
        const { messages } = state;
        const lastMessage = messages.filter(m => isHumanMessage(m)).at(-1);
        const question = typeof lastMessage?.content === 'string' ? lastMessage.content : "";

        const model = new ChatOpenAI({
          model: llmModel,
          temperature: 0,
        }).withStructuredOutput(routerSchema);

        const response = await routerPrompt.pipe(model).invoke({
          question,
        });

        return response.path === "chit-chat" ? "chitChat" : "generate";
      } catch (error) {
        console.error("Error in decideRoute:", error);
        return "chitChat";
      }
    }


    // Define the simplified graph with two clear paths
    const builder = new StateGraph(AgentStateAnnotation)
      .addNode("router", router)
      .addNode("chitChat", chitChat)
      .addNode("generate", generate)
      // Add edges
      .addEdge(START, "router")
      .addConditionalEdges("router", decideRoute)
      .addEdge("chitChat", END)
      .addEdge("generate", END)



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