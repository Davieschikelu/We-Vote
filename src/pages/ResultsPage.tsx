import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface VoteCount {
  candidate_id: string;
  candidate_name: string;
  vote_count: number;
}

interface Election {
  id: string;
  title: string;
  description: string;
}

const ResultsPage = () => {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [election, setElection] = useState<Election | null>(null);
  const [results, setResults] = useState<VoteCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    fetchResults();
    
    // Set up realtime subscription for vote updates
    const channel = supabase
      .channel("vote-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "votes",
          filter: `election_id=eq.${electionId}`,
        },
        () => {
          fetchResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [electionId, user]);

  const fetchResults = async () => {
    try {
      const { data: electionData, error: electionError } = await supabase
        .from("elections")
        .select("*")
        .eq("id", electionId)
        .single();

      if (electionError) throw electionError;
      setElection(electionData);

      const { data, error } = await supabase.rpc("get_vote_counts", {
        election_uuid: electionId,
      });

      if (error) throw error;

      const resultsData = data as VoteCount[];
      setResults(resultsData);
      setTotalVotes(resultsData.reduce((sum, r) => sum + Number(r.vote_count), 0));
    } catch (error: any) {
      toast.error("Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Candidate", "Votes", "Percentage"],
      ...results.map((r) => [
        r.candidate_name,
        r.vote_count,
        totalVotes > 0 ? `${((Number(r.vote_count) / totalVotes) * 100).toFixed(2)}%` : "0%",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `election-${electionId}-results.csv`;
    a.click();
    toast.success("Results exported successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  const chartData = results.map((r) => ({
    name: r.candidate_name,
    votes: Number(r.vote_count),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-primary" />
                    {election?.title} - Results
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Real-time election results
                  </CardDescription>
                </div>
                <Button onClick={handleExport} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Vote Distribution</CardTitle>
                <CardDescription>Total votes cast: {totalVotes}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="votes" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {results.map((result, index) => {
                    const percentage =
                      totalVotes > 0
                        ? (Number(result.vote_count) / totalVotes) * 100
                        : 0;
                    return (
                      <div key={result.candidate_id}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">
                              #{index + 1}
                            </span>
                            <span className="font-medium">{result.candidate_name}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{result.vote_count} votes</div>
                            <div className="text-sm text-muted-foreground">
                              {percentage.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResultsPage;
