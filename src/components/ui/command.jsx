import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./dialog";

/**
 * Command — shadcn-style cmdk wrapper themed for ScholarshipZone (light + dark).
 *
 * Usage:
 *   <CommandDialog open={open} onOpenChange={setOpen}>
 *     <CommandInput placeholder="Type a command…" />
 *     <CommandList>
 *       <CommandEmpty>No results.</CommandEmpty>
 *       <CommandGroup heading="Navigation">
 *         <CommandItem onSelect={…}>Go to applicants</CommandItem>
 *       </CommandGroup>
 *     </CommandList>
 *   </CommandDialog>
 */

const Command = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-xl bg-surface text-ink",
      className
    )}
    {...props}
  />
));
Command.displayName = "Command";

const CommandDialog = ({ open, onOpenChange, children, label = "Command palette" }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      showClose={false}
      className="overflow-hidden p-0 gap-0 sm:max-w-[640px]"
    >
      <DialogTitle className="sr-only">{label}</DialogTitle>
      <DialogDescription className="sr-only">
        Search and execute commands. Use arrow keys to navigate.
      </DialogDescription>
      <Command
        className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]]:px-3 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4"
      >
        {children}
      </Command>
    </DialogContent>
  </Dialog>
);

const CommandInput = React.forwardRef(({ className, ...props }, ref) => (
  <div
    className="flex items-center gap-2 border-b border-border px-3"
    cmdk-input-wrapper=""
  >
    <Search className="shrink-0 text-muted" aria-hidden="true" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[360px] overflow-y-auto overflow-x-hidden p-1", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

const CommandEmpty = React.forwardRef((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm text-muted"
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";

const CommandLoading = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Loading
    ref={ref}
    className={cn("py-6 text-center text-sm text-muted", className)}
    {...props}
  />
));
CommandLoading.displayName = "CommandLoading";

const CommandGroup = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn("overflow-hidden text-ink", className)}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

const CommandSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
CommandSeparator.displayName = "CommandSeparator";

const CommandItem = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-md text-sm text-ink outline-none",
      "data-[selected=true]:bg-slate-100 data-[selected=true]:text-ink",
      "dark:data-[selected=true]:bg-slate-800",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-muted",
      className
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

const CommandShortcut = ({ className, ...props }) => (
  <span
    className={cn(
      "ml-auto text-[11px] font-medium tracking-wider text-muted",
      className
    )}
    {...props}
  />
);
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandLoading,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
