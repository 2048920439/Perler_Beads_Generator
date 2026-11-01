export default function Page() {
  const basePath = (process.env.NEXT_BASE_PATH ?? '').replace(/\/$/, '');
  const target = `${basePath}/zh/`;

  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${target}`} />
      <main className="locale-entry">
        <p>
          <a href={target}>Continue to the default language</a>
        </p>
      </main>
    </>
  );
}
