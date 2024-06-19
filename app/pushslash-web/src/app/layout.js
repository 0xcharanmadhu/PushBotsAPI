
import "./globals.css";


export const metadata = {
  title: "PushSlash",
  description: "The Slash Service for Push Chats.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
