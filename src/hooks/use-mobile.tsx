import * as React from "react"

// Defines the breakpoint (in pixels) that determines what is considered a mobile device.
// Devices with a width less than this breakpoint will be considered mobile.
const MOBILE_BREAKPOINT = 768

/**
 * Custom hook to detect if the current viewport width corresponds to a mobile device.
 * It uses `window.matchMedia` for responsive checking and updates its state on resize.
 * @returns {boolean} `true` if the current viewport is mobile (less than MOBILE_BREAKPOINT), `false` otherwise.
 */
export function useIsMobile() {
  // State to store the mobile status. Initialized to `undefined` to allow for client-side detection.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  // Effect hook to set up and clean up the media query listener.
  React.useEffect(() => {
    // Create a MediaQueryList object that listens for changes to the screen width.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    // Define the event handler for media query changes.
    const onChange = () => {
      // Update `isMobile` state based on the current window width relative to the breakpoint.
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Add the event listener to the media query list.
    mql.addEventListener("change", onChange)
    
    // Set the initial `isMobile` state immediately when the component mounts.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    
    // Cleanup function: remove the event listener when the component unmounts.
    return () => mql.removeEventListener("change", onChange)
  }, []) // Empty dependency array ensures this effect runs only once on mount.

  // Returns the `isMobile` state, ensuring it's always a boolean (handles `undefined` initial state).
  return !!isMobile
}
