import {client} from './client'
import {berlinDrivingProject, includeBerlinDriving} from '@/content/berlin-driving-simulator'
import {
  matterReelProjectsQuery,
  projectBySlugQuery,
  projectNavQuery,
  projectSlugsQuery,
  projectsQuery,
  resourcesQuery,
  resourceSlugsQuery,
  berlinDrivingPresenceQuery,
} from './queries'
import type {Project, ProjectListItem, ProjectNavItem} from '../types'

export async function getProjects() {
  const [projects, cmsOwnsBerlin] = await Promise.all([client.fetch<ProjectListItem[]>(projectsQuery), client.fetch<boolean>(berlinDrivingPresenceQuery)])
  return includeBerlinDriving(projects, berlinDrivingProject, cmsOwnsBerlin)
}

export function getMatterReelProjects(slugs: readonly string[]) {
  return client.fetch<ProjectListItem[]>(matterReelProjectsQuery, {slugs})
}

export async function getProjectBySlug(slug: string) {
  const project = await client.fetch<Project | null>(projectBySlugQuery, {slug})
  if (project) return project
  if (slug === berlinDrivingProject.slug) return await client.fetch<boolean>(berlinDrivingPresenceQuery) ? null : berlinDrivingProject
  return null
}

export async function getProjectSlugs() {
  const [slugs, cmsOwnsBerlin] = await Promise.all([client.fetch<{slug: string}[]>(projectSlugsQuery), client.fetch<boolean>(berlinDrivingPresenceQuery)])
  return includeBerlinDriving(slugs, {slug: berlinDrivingProject.slug}, cmsOwnsBerlin)
}

export async function getProjectNavigation() {
  const [projects, cmsOwnsBerlin] = await Promise.all([client.fetch<ProjectNavItem[]>(projectNavQuery), client.fetch<boolean>(berlinDrivingPresenceQuery)])
  return includeBerlinDriving(projects, {slug: berlinDrivingProject.slug, title: berlinDrivingProject.title}, cmsOwnsBerlin)
}

export function getResources() {
  return client.fetch<ProjectListItem[]>(resourcesQuery)
}

export function getResourceSlugs() {
  return client.fetch<{slug: string}[]>(resourceSlugsQuery)
}
