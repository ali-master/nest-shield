import { redirect } from "next/navigation";

export default function RootLayout({ children: _children }: { children: React.ReactNode }) {
  // Redirect to default locale
  redirect("/en");
}
