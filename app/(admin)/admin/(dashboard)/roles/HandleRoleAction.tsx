"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { createRoleSchema } from "@/zodSchemas/createRoleSchema";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/loading-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RoleData } from "../../../../../lib/types";
import { CreateUserSchema } from "../../../../../zodSchemas/createUserSchema";
import { PasswordInput } from "../../../../../components/password-input";

type CreateRoleValues = z.infer<typeof createRoleSchema>;

type Props = { onSuccess: () => void };

export function CreateRoleButton({ onSuccess }: Props) {

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateRoleValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function onSubmit(values: CreateRoleValues) {
    setLoading(true);

    try {
      const res = await fetch("/api/roles/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create role");
        return;
      }

      toast.success("Role created successfully");

      form.reset();
      setOpen(false);
      onSuccess()
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground p-1.5 sm:px-3 sm:py-2 rounded-md text-xs font-medium transition-colors shadow-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Create Role</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Role</DialogTitle>
          <DialogDescription>
            Define a new role and its access permissions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter role name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter role description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              loading={loading}
              className="w-full"
            >
              Create Role
            </LoadingButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Add this component at the bottom of the file
type DeleteRoleProps = {
  role: RoleData;
  onSuccess: () => void;
};

export function DeleteRoleButton({ role, onSuccess }: DeleteRoleProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    if (role._count.users > 0) {
      toast.error(`Cannot delete — ${role._count.users} user(s) are assigned to this role`);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to delete role");
        return;
      }

      toast.success(`Role "${role.name}" deleted`);
      setOpen(false);
      onSuccess();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          className="text-destructive/80 hover:text-destructive transition-colors p-1"
          title="Delete Role"
        >
          <Trash2 size={16} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{role.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the role and all its permissions.
            {role._count.users > 0 && (
              <span className="block mt-2 text-destructive font-medium">
                ⚠ {role._count.users} user(s) are assigned to this role. Reassign them before deleting.
              </span>
            )}
            {role._count.users === 0 && " This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading || role._count.users > 0}
            className="bg-red-600 hover:bg-red-700 text-foreground"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type CreateUserProps = {
  onSuccess: () => void;
  roles?: RoleData[];
};

type CreateUserValues = z.infer<typeof CreateUserSchema>;

export function CreateUserButton({ onSuccess, roles: propsRoles }: CreateUserProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<RoleData[]>(propsRoles || []);

  useEffect(() => {
    if (propsRoles) {
      setRoles(propsRoles);
    } else if (open) {
      fetch("/api/roles")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setRoles(data);
          else if (data && Array.isArray(data.roles)) setRoles(data.roles);
        })
        .catch(() => {});
    }
  }, [open, propsRoles]);

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleId: "",
    },
  });

  async function onSubmit(values: CreateUserValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create user");
        return;
      }

      toast.success("User created successfully");
      form.reset();
      setOpen(false);
      onSuccess();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-md text-xs font-medium transition-colors shadow-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Create User</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Create a new user account and assign them a role.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Enter password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Select Role (Default Customer) —</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <LoadingButton type="submit" loading={loading} className="w-full">
              Create User
            </LoadingButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


