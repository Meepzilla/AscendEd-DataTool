"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

// Defines the maximum number of toasts that can be displayed at once.
const TOAST_LIMIT = 1
// Defines the delay in milliseconds before a toast is removed from the DOM after it's dismissed.
// A very large value here effectively means toasts are not automatically removed by a timeout after dismissal.
const TOAST_REMOVE_DELAY = 1000000

// Type definition for a toast object, extending standard ToastProps with an ID.
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// Defines action types for the toast reducer, ensuring type safety for dispatch actions (used as a type only).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

// Counter for generating unique toast IDs.
let count = 0

// Function to generate a unique ID for each toast.
// It ensures the ID is a string and cycles through numbers to prevent overflow.
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

// Type alias for all possible action types.
type ActionType = typeof actionTypes

// Union type for all possible actions that can be dispatched to the toast reducer.
type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

// Interface defining the shape of the toast state.
interface State {
  toasts: ToasterToast[]
}

// A Map to store timeouts for dismissing toasts, keyed by toast ID.
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Adds a toast ID to the remove queue with a specified delay.
 * This function sets a timeout to dispatch a REMOVE_TOAST action after TOAST_REMOVE_DELAY.
 * @param toastId The ID of the toast to add to the remove queue.
 */
const addToRemoveQueue = (toastId: string) => {
  // If a timeout for this toast already exists, do nothing.
  if (toastTimeouts.has(toastId)) {
    return
  }

  // Set a timeout to remove the toast.
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  // Store the timeout ID so it can be cleared if needed.
  toastTimeouts.set(toastId, timeout)
}

/**
 * Reducer function to manage the state of toasts.
 * It handles adding, updating, dismissing, and removing toasts.
 * @param state The current state of toasts.
 * @param action The action to be performed on the toast state.
 * @returns The new state of toasts.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      // Adds a new toast to the beginning of the array, limiting the total number of toasts.
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      // Updates an existing toast by merging new properties based on its ID.
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // Side effects: Adds toast(s) to the remove queue.
      // This logic could be separated into a distinct action creator for cleaner reducer.
      if (toastId) {
        addToRemoveQueue(toastId)
      } else { // If no specific toastId is provided, dismiss all toasts.
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      // Marks the dismissed toast(s) as not open.
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      // Removes a toast completely from the state.
      if (action.toastId === undefined) { // If no specific toastId, remove all toasts.
        return {
          ...state,
          toasts: [],
        }
      }
      // Filters out the toast with the matching ID.
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// Array of listeners that will be notified when the toast state changes.
const listeners: Array<(state: State) => void> = []

// In-memory state for toasts, allowing toast instances to exist outside React components.
let memoryState: State = { toasts: [] }

/**
 * Dispatches an action to the toast reducer and notifies all listeners of the state change.
 * @param action The action to dispatch.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

// Type alias for a toast payload, omitting the generated ID.
type Toast = Omit<ToasterToast, "id">

/**
 * Function to create and display a new toast notification.
 * It generates a unique ID, dispatches an ADD_TOAST action, and returns methods to update or dismiss the toast.
 * @param props The properties of the toast (title, description, variant, etc.).
 * @returns An object with the toast's ID and functions to update or dismiss it.
 */
function toast({ ...props }: Toast) {
  const id = genId()

  // Function to update an existing toast.
  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  // Function to dismiss a specific toast.
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  // Dispatch the ADD_TOAST action to add the new toast to the state.
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true, // Mark toast as open initially.
      // Callback for when the toast's open state changes (e.g., user closes it).
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  // Return control functions for the created toast.
  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * Custom hook to consume and interact with the toast system.
 * It subscribes to toast state changes and provides access to the current toasts and dispatch functions.
 * @returns An object containing the current toasts array and functions to add or dismiss toasts.
 */
function useToast() {
  // Local state to hold the current toast state from memoryState.
  const [state, setState] = React.useState<State>(memoryState)

  // Effect hook to subscribe and unsubscribe from state changes.
  React.useEffect(() => {
    // Add the setState function to the list of listeners.
    listeners.push(setState)
    // Cleanup function: remove the setState function from listeners when component unmounts.
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state]) // Dependency array: re-run effect if state changes (though this is reactive to memoryState, so setState is typically stable).

  // Return the current toast state and action functions.
  return {
    ...state,
    toast, // Function to add a new toast.
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }), // Function to dismiss toast(s).
  }
}

// Export the useToast hook and toast function for external use.
export { useToast, toast }
