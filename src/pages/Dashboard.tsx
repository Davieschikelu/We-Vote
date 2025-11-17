import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Vote, Calendar, LogOut, Shield, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface Election {
  id: string;
  title: string;
  description: string;
  status: string;
  is_anonymous: boolean;
  start_date: string;
  end_date: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signOut, loading: authLoading } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedElections, setVotedElections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchElections();
      fetchVotedElections();
    }
  }, [user]);

  const fetchElections = async () => {
    try {
      const { data, error } = await supabase
        .from("elections")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setElections(data || []);
    } catch (error: any) {
      toast.error("Failed to load elections");
    } finally {
      setLoading(false);
    }
  };

  const fetchVotedElections = async () => {
    try {
      const { data, error } = await supabase
        .from("votes")
        .select("election_id")
        .eq("voter_id", user?.id);

      if (error) throw error;
      setVotedElections(new Set(data?.map((v) => v.election_id) || []));
    } catch (error: any) {
      console.error("Failed to load voted elections", error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">BU Vote</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Button onClick={() => navigate("/admin")} variant="outline">
                <Shield className="w-4 h-4 mr-2" />
                Admin Panel
              </Button>
            )}
            <Button onClick={signOut} variant="ghost">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Active Elections</h2>
            <p className="text-muted-foreground">
              Cast your vote in the elections below
            </p>
          </div>

          {elections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Vote className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Active Elections</h3>
                <p className="text-muted-foreground text-center">
                  There are no elections available at the moment. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {elections.map((election) => {
                const hasVoted = votedElections.has(election.id);
                return (
                  <Card key={election.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl mb-2">{election.title}</CardTitle>
                          <CardDescription>{election.description}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {election.is_anonymous && (
                            <Badge variant="secondary">Anonymous</Badge>
                          )}
                          {hasVoted && (
                            <Badge variant="default" className="bg-success">Voted</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(election.start_date).toLocaleDateString()} - {new Date(election.end_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!hasVoted && (
                          <Button
                            onClick={() => navigate(`/vote/${election.id}`)}
                            className="flex-1"
                          >
                            <Vote className="w-4 h-4 mr-2" />
                            Cast Vote
                          </Button>
                        )}
                        <Button
                          onClick={() => navigate(`/results/${election.id}`)}
                          variant="outline"
                          className="flex-1"
                        >
                          <BarChart3 className="w-4 h-4 mr-2" />
                          View Results
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
