import { isDemoMode } from '@/lib/config';
import { demoRepository } from './demo/demoRepository';
import type { Repository } from './repository';
import { supabaseRepository } from './supabase/supabaseRepository';

/** The single data source for the app. Demo data unless Supabase is configured. */
export const repo: Repository = isDemoMode ? demoRepository : supabaseRepository;

export type * from './types';
export type { Repository } from './repository';
