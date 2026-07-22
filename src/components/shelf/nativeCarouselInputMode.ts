import { createContext } from "react";

/** True only while Steam controller input owns this native carousel.
 * Mouse movement returns ownership to Steam's native :hover styling.
 */
export const NativeCarouselControllerInputContext = createContext(false);
