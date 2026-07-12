export interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}
