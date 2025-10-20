import type { Metadata } from "next";

import { CopilotKit } from "@copilotkit/react-core";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";

export const metadata: Metadata = {
  title: "Harry Potter Assistant",
  description: "A virtual assistant for all your Harry Potter queries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={"antialiased h-max"}>
        <CopilotKit runtimeUrl="/api/copilotkit" agent="starterAgent">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
