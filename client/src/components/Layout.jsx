import Nav from './Nav.jsx';

export default function Layout({ user, children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={user} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
