import { CopilotChat } from "@copilotkit/react-ui";

export default function ChatComponent() {
  return (
    <CopilotChat className="h-screen"
      instructions={"You are assisting the user with their inquiry about Harry Potter. Answer in the best way possible given the data you have."}
      labels={{
        title: "Harry Potter Info Bot",
        initial: "Hi! I'm here to help you with any questions about Harry Potter books, characters, and themes. Ask me anything!",
      }}
    />
  );
}