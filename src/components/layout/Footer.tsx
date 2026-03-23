export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-black">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <p className="text-xs text-gray-500">&copy; {year} Van Kruiningen Reklame</p>
          <p className="text-xs text-gray-600">Powered by DataBiz</p>
        </div>
      </div>
    </footer>
  );
}
