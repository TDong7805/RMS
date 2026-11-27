import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getPublicGallery, getPublicMenu, getPublicPost, getPublicPosts, getPublicSite } from '@/api/public-site';
import type { PublicMenuFilter } from '@/types';

/** Khóa query của website khách hàng. Dữ liệu ít đổi → giữ 60 giây, tải lại khi khách quay lại tab. */
export const ps = {
  all: ['public-site'] as const,
  site: ['public-site', 'site'] as const,
  menu: ['public-site', 'menu'] as const,
  gallery: ['public-site', 'gallery'] as const,
};

const STALE = 60_000;

export const useSite = () =>
  useQuery({ queryKey: ps.site, queryFn: getPublicSite, staleTime: STALE, refetchOnWindowFocus: true });

export const usePublicMenu = (f: PublicMenuFilter) =>
  useQuery({ queryKey: [...ps.menu, f], queryFn: () => getPublicMenu(f), staleTime: STALE, placeholderData: keepPreviousData });

export const useGallery = () => useQuery({ queryKey: ps.gallery, queryFn: getPublicGallery, staleTime: STALE });

export const usePublicPosts = (category = '', limit = 12) =>
  useQuery({ queryKey: ['public-site', 'posts', category, limit], queryFn: () => getPublicPosts(category, limit), staleTime: STALE });

export const usePublicPost = (slug: string) =>
  useQuery({ queryKey: ['public-site', 'post', slug], queryFn: () => getPublicPost(slug), staleTime: STALE, retry: false, enabled: Boolean(slug) });
