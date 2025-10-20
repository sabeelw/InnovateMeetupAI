
import { ChatPromptTemplate } from "@langchain/core/prompts";

export const gradingPrompt = ChatPromptTemplate.fromTemplate(
    `You are a grader assessing relevance of retrieved docs to a user question.
    Here are the retrieved docs:
    \n ------- \n
    {context}
    \n ------- \n
    Here is the user question: {question}
    If the content of the docs are relevant to the users question, score them as relevant.
    Give a binary score 'yes' or 'no' score to indicate whether the docs are relevant to the question.
    Yes: The docs are relevant to the question.
    No: The docs are not relevant to the question.`,
);


export const rewritePrompt = ChatPromptTemplate.fromTemplate(
    `Look at the input and try to reason about the underlying semantic intent / meaning. \n
  Here is the initial question:
  \n ------- \n
  {question}
  \n ------- \n
  Formulate an improved question:`,
);

export const generatePrompt = ChatPromptTemplate.fromTemplate(
    `You are an assistant for question-answering tasks.
        Use the following pieces of retrieved context to answer the question.
        If you don't know the answer, just say that you don't know.
        Use three sentences maximum and keep the answer concise.
        Question: {question}
        Context: {context}`
);