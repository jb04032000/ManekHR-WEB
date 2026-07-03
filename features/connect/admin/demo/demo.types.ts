/** One seeded Connect demo account + its content counts (admin demo manager). */
export interface DemoUserRow {
  id: string;
  name: string;
  mobile: string;
  handle: string;
  headline: string;
  posts: number;
  listings: number;
  jobs: number;
  /** Dev mock OTP used to sign in as this demo account. */
  loginOtp: string;
}
