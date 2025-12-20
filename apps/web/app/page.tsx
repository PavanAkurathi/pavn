import { Button } from "@repo/ui/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">Hive Web App</h1>
      <Button>Click me</Button>
    </div>
  );
}
