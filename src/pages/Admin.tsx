import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Election {
  id: string;
  title: string;
  status: string;
}

interface Candidate {
  id?: string;
  name: string;
  description: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(false);

  // New election form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "closed">("draft");
  const [candidates, setCandidates] = useState<Candidate[]>([
    { name: "", description: "" },
  ]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchElections();
    }
  }, [isAdmin]);

  const fetchElections = async () => {
    const { data } = await supabase
      .from("elections")
      .select("*")
      .order("created_at", { ascending: false });
    setElections(data || []);
  };

  const addCandidate = () => {
    setCandidates([...candidates, { name: "", description: "" }]);
  };

  const removeCandidate = (index: number) => {
    setCandidates(candidates.filter((_, i) => i !== index));
  };

  const updateCandidate = (index: number, field: keyof Candidate, value: string) => {
    const updated = [...candidates];
    updated[index] = { ...updated[index], [field]: value };
    setCandidates(updated);
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate candidates
      const validCandidates = candidates.filter((c) => c.name.trim() !== "");
      if (validCandidates.length < 2) {
        toast.error("Please add at least 2 candidates");
        setLoading(false);
        return;
      }

      // Create election
      const { data: electionData, error: electionError } = await supabase
        .from("elections")
        .insert({
          title,
          description,
          status,
          is_anonymous: isAnonymous,
          start_date: startDate,
          end_date: endDate,
          created_by: user?.id,
        })
        .select()
        .single();

      if (electionError) throw electionError;

      // Create candidates
      const candidatesData = validCandidates.map((c) => ({
        election_id: electionData.id,
        name: c.name,
        description: c.description,
      }));

      const { error: candidatesError } = await supabase
        .from("candidates")
        .insert(candidatesData);

      if (candidatesError) throw candidatesError;

      // Log the action
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        action: "election_created",
        details: {
          election_id: electionData.id,
          title,
        },
      });

      toast.success("Election created successfully!");
      
      // Reset form
      setTitle("");
      setDescription("");
      setIsAnonymous(false);
      setStartDate("");
      setEndDate("");
      setStatus("draft");
      setCandidates([{ name: "", description: "" }]);
      
      fetchElections();
    } catch (error: any) {
      toast.error(error.message || "Failed to create election");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteElection = async (id: string) => {
    if (!confirm("Are you sure you want to delete this election?")) return;

    try {
      const { error } = await supabase.from("elections").delete().eq("id", id);
      if (error) throw error;
      
      toast.success("Election deleted successfully");
      fetchElections();
    } catch (error: any) {
      toast.error("Failed to delete election");
    }
  };

  if (authLoading) {
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
          <div className="mb-8 flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Panel</h1>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Election</CardTitle>
              <CardDescription>
                Fill in the details below to create a new election
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateElection} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="title">Election Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., BUSA President Election 2025"
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of the election"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={status}
                      onValueChange={(value: any) => setStatus(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="anonymous"
                      checked={isAnonymous}
                      onCheckedChange={setIsAnonymous}
                    />
                    <Label htmlFor="anonymous">Anonymous Voting</Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Candidates</Label>
                    <Button type="button" onClick={addCandidate} variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Candidate
                    </Button>
                  </div>

                  {candidates.map((candidate, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 space-y-4">
                              <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                  value={candidate.name}
                                  onChange={(e) =>
                                    updateCandidate(index, "name", e.target.value)
                                  }
                                  placeholder="Candidate name"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                  value={candidate.description}
                                  onChange={(e) =>
                                    updateCandidate(index, "description", e.target.value)
                                  }
                                  placeholder="Brief bio or manifesto"
                                />
                              </div>
                            </div>
                            {candidates.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCandidate(index)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create Election"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Elections</CardTitle>
              <CardDescription>Manage all elections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {elections.map((election) => (
                  <Card key={election.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <h3 className="font-semibold">{election.title}</h3>
                        <p className="text-sm text-muted-foreground capitalize">
                          Status: {election.status}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteElection(election.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
