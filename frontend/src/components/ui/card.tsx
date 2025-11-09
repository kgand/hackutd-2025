import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...additionalProps }, forwardedRef) => (
  <div
    ref={forwardedRef}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...additionalProps}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...additionalProps }, forwardedRef) => (
  <div
    ref={forwardedRef}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...additionalProps}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...additionalProps }, forwardedRef) => (
  <h3
    ref={forwardedRef}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...additionalProps}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...additionalProps }, forwardedRef) => (
  <p
    ref={forwardedRef}
    className={cn("text-sm text-muted-foreground", className)}
    {...additionalProps}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...additionalProps }, forwardedRef) => (
  <div ref={forwardedRef} className={cn("p-6 pt-0", className)} {...additionalProps} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...additionalProps }, forwardedRef) => (
  <div
    ref={forwardedRef}
    className={cn("flex items-center p-6 pt-0", className)}
    {...additionalProps}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
