import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertApiSettingsSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const formSchema = insertApiSettingsSchema.extend({
  amazonSecretKey: z.string().min(1, "Amazon Secret Key is required"),
  anthropicApiKey: z.string().min(1, "Anthropic API Key is required"),
});

export default function ApiSettings() {
  const { toast } = useToast();
  
  const { data, isLoading } = useQuery({
    queryKey: ['/api/settings'],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amazonPartnerId: "",
      amazonApiKey: "",
      amazonSecretKey: "",
      anthropicApiKey: "",
    },
  });

  useEffect(() => {
    if (data?.settings) {
      form.reset({
        amazonPartnerId: data.settings.amazonPartnerId || "",
        amazonApiKey: data.settings.amazonApiKey || "",
        amazonSecretKey: data.settings.amazonSecretKey || "",
        anthropicApiKey: data.settings.anthropicApiKey || "",
      });
    }
  }, [data, form]);

  const updateSettings = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await apiRequest("POST", "/api/settings", values);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your API settings have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateSettings.mutate(values);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">API Settings</CardTitle>
          <CardDescription>
            Configure your Amazon Partner API and Anthropic API credentials. These are required for content generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="border-b pb-2">
                    <h3 className="text-lg font-medium">Amazon Partner API</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="amazonPartnerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amazon Partner ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. amzn-partner-123" {...field} />
                        </FormControl>
                        <FormDescription>
                          Your Amazon Associate/Partner tag for generating affiliate links
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amazonApiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter Amazon API Key" type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="amazonSecretKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secret Key</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter Amazon Secret Key" type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="border-b pb-2">
                    <h3 className="text-lg font-medium">Anthropic API</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="anthropicApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter Anthropic API Key" type="password" {...field} />
                        </FormControl>
                        <FormDescription>
                          API key for Anthropic Claude to generate content
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateSettings.isPending}
                    className="bg-primary hover:bg-primary-dark text-white"
                  >
                    {updateSettings.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : "Save Settings"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
