export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-6">
          <p className="text-xs text-gray-400">&copy; {year} DataBiz</p>
          <p className="text-xs text-gray-300">Workwear Showcase</p>
        </div>
      </div>
    </footer>
  );
}
