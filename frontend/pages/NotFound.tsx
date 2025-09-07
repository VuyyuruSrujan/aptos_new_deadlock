import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Home, Search } from "lucide-react";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="container mx-auto max-w-2xl text-center">
        <Card className="border-primary/20">
          <CardHeader className="space-y-6">
            <div className="text-6xl font-bold text-primary">404</div>
            <CardTitle className="text-2xl">Page Not Found</CardTitle>
            <CardDescription className="text-lg">
              The page you're looking for doesn't exist or has been moved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/dashboard">
                  <Search className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
            </div>
            
            <div className="pt-6">
              <Button variant="ghost" asChild>
                <Link to="/" className="text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to previous page
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default NotFound;