import { CopilotChat } from "@copilotkit/react-ui";

export default function ChatComponent() {
  return (
    <CopilotChat className="h-screen"
      instructions={"You are assisting the user with their inquiry about Harry Potter. Answer in the best way possible given the data you have."}
      labels={{
        title: "Your Assistant",
        initial: "Hi! 👋 How can I assist you today?",
      }}
    />
  );
}