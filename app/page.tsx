import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user=await getChatGPTUser();
  if (!user) return <main className="signin"><div className="signin-card"><div className="logo-mark">K<span>↗</span></div><p className="eyebrow">YOUR CREW, YOUR COMMITMENTS</p><h1>Show up for yourself.<br/>Let your friends see it.</h1><p>Track your routines, post proof, and stay accountable together.</p><a className="primary-link" href={chatGPTSignInPath("/")} target="_top">Sign in with ChatGPT <span>↗</span></a></div></main>;
  return <Dashboard />;
}
