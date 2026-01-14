import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"

export interface DropdownMenuContentProps extends React.ComponentPropsWithoutRef<'div'> {
  sideOffset?: number
  children?: React.ReactNode
}

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<'div'> {
  inset?: boolean
  children?: React.ReactNode
}

export interface DropdownMenuSeparatorProps extends React.ComponentPropsWithoutRef<'div'> {
  className?: string
}

declare const DropdownMenu: typeof DropdownMenuPrimitive.Root
declare const DropdownMenuTrigger: typeof DropdownMenuPrimitive.Trigger
declare const DropdownMenuContent: React.ForwardRefExoticComponent<
  DropdownMenuContentProps & React.RefAttributes<HTMLDivElement>
> & {
  displayName?: string
}

declare const DropdownMenuItem: React.ForwardRefExoticComponent<
  DropdownMenuItemProps & React.RefAttributes<HTMLDivElement>
> & {
  displayName?: string
}

declare const DropdownMenuSeparator: React.ForwardRefExoticComponent<
  DropdownMenuSeparatorProps & React.RefAttributes<HTMLDivElement>
> & {
  displayName?: string
}

declare const DropdownMenuGroup: typeof DropdownMenuPrimitive.Group
declare const DropdownMenuPortal: typeof DropdownMenuPrimitive.Portal
declare const DropdownMenuSub: typeof DropdownMenuPrimitive.Sub
declare const DropdownMenuSubContent: any
declare const DropdownMenuSubTrigger: any
declare const DropdownMenuRadioGroup: typeof DropdownMenuPrimitive.RadioGroup
declare const DropdownMenuCheckboxItem: any
declare const DropdownMenuRadioItem: any
declare const DropdownMenuLabel: any
declare const DropdownMenuShortcut: any

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
