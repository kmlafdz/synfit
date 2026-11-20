import React, { forwardRef, useMemo } from "react";
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
  useLocation,
  useNavigate,
  useSearchParams as useRRSearchParams,
} from "react-router-dom";

export interface LinkProps extends Omit<RouterLinkProps, "to" | "prefetch"> {
  href: string;
  prefetch?: boolean | RouterLinkProps["prefetch"];
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, prefetch: _prefetch, ...props }, ref) => {
    return <RouterLink ref={ref} to={href} {...props} />;
  }
);
Link.displayName = "Link";

export function useRouter() {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => window.location.reload(),
      prefetch: () => {},
    }),
    [navigate]
  );
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams() {
  const [searchParams] = useRRSearchParams();
  return searchParams;
}

export default Link;
