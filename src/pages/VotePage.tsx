import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Vote, Shield } from "lucide-react";
import { toast } from "sonner";

interface Candidate {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
}

interface Election {
  id: string;
  title: string;
  description: string;
  is_anonymous: boolean;
}

const VotePage = () => {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    fetchElectionAndCandidates();
    checkIfAlreadyVoted();
  }, [electionId, user]);

  const checkIfAlreadyVoted = async () => {
    const { data } = await supabase
      .from("votes")
      .select("id")
      .eq("election_id", electionId)
      .eq("voter_id", user?.id)
      .maybeSingle();

    if (data) {
      toast.error("You have already voted in this election");
      navigate("/dashboard");
    }
  };

  const fetchElectionAndCandidates = async () => {
    try {
      const { data: electionData, error: electionError } = await supabase
        .from("elections")
        .select("*")
        .eq("id", electionId)
        .single();

      if (electionError) throw electionError;
      setElection(electionData);

      const { data: candidatesData, error: candidatesError } = await supabase
        .from("candidates")
        .select("*")
        .eq("election_id", electionId)
        .order("name");

      if (candidatesError) throw candidatesError;
      setCandidates(candidatesData || []);
    } catch (error: any) {
      toast.error("Failed to load election details");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitVote = async () => {
    if (!selectedCandidate) {
      toast.error("Please select a candidate");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("votes").insert({
        election_id: electionId,
        candidate_id: selectedCandidate,
        voter_id: user?.id,
      });

      if (error) throw error;

      // Log the vote
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        action: "vote_cast",
        details: {
          election_id: electionId,
          election_title: election?.title,
        },
      });

      toast.success("Vote submitted successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading election...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-2xl">{election?.title}</CardTitle>
              <CardDescription>{election?.description}</CardDescription>
              {election?.is_anonymous && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                  <Shield className="w-4 h-4" />
                  <span>This is an anonymous election - your vote is private</span>
                </div>
              )}
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Your Candidate</CardTitle>
              <CardDescription>
                Choose one candidate from the list below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedCandidate} onValueChange={setSelectedCandidate}>
                <div className="space-y-4">
                  {candidates.map((candidate) => (
                    <Card
                      key={candidate.id}
                      className={`cursor-pointer transition-all ${
                        selectedCandidate === candidate.id
                          ? "ring-2 ring-primary shadow-lg"
                          : "hover:shadow-md"
                      }`}
                      onClick={() => setSelectedCandidate(candidate.id)}
                    >
                      <CardContent className="flex items-start gap-4 p-4">
                        <RadioGroupItem value={candidate.id} id={candidate.id} />
                        <Label
                          htmlFor={candidate.id}
                          className="flex-1 cursor-pointer"
                        >
                          <div>
                            <h3 className="font-semibold text-lg">{candidate.name}</h3>
                            {candidate.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {candidate.description}
                              </p>
                            )}
                          </div>
                        </Label>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </RadioGroup>

              <Button
                onClick={handleSubmitVote}
                disabled={!selectedCandidate || submitting}
                className="w-full mt-6"
                size="lg"
              >
                <Vote className="w-4 h-4 mr-2" />
                {submitting ? "Submitting..." : "Submit Vote"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default VotePage;
