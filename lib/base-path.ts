// Path prefix the site is served under (e.g. "/course"), set at build time.
// Empty = served at the root. Next's <Link>, redirect() and revalidatePath add
// it on their own; use withBasePath() only for plain <a href>, <form action>
// and Auth.js redirect targets.
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
