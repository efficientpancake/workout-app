import { redirect } from "next/navigation";

// The app opens on Today.
export default function Home() {
  redirect("/today");
}
