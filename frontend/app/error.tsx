"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal-error">
      <h1>This view could not be opened</h1>
      <p>
        Try loading the view again. Your saved records have not been changed.
      </p>
      <button onClick={reset}>Reload view</button>
    </main>
  );
}
