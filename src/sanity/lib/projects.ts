import {client} from './client'
import {berlinDrivingProject, includeBerlinDriving} from '@/content/berlin-driving-simulator'
import {sixSeasProject, includeSixSeas} from '@/content/six-seas'
import {
  matterReelProjectsQuery,
  projectBySlugQuery,
  projectNavQuery,
  projectSlugsQuery,
  projectsQuery,
  resourcesQuery,
  resourceSlugsQuery,
  berlinDrivingPresenceQuery,
  sixSeasPresenceQuery,
} from './queries'
import type {Project, ProjectListItem, ProjectNavItem} from '../types'

export async function getProjects() {
  const [projects, cmsOwnsBerlin, cmsOwnsSixSeas] = await Promise.all([client.fetch<ProjectListItem[]>(projectsQuery), client.fetch<boolean>(berlinDrivingPresenceQuery), client.fetch<boolean>(sixSeasPresenceQuery)])
  return includeSixSeas(includeBerlinDriving(projects, berlinDrivingProject, cmsOwnsBerlin), sixSeasProject, cmsOwnsSixSeas)
}

export function getMatterReelProjects(slugs: readonly string[]) {
  return client.fetch<ProjectListItem[]>(matterReelProjectsQuery, {slugs})
}

export async function getProjectBySlug(slug: string) {
  const project = await client.fetch<Project | null>(projectBySlugQuery, {slug})
  if (project) return project
  if (slug === berlinDrivingProject.slug) return await client.fetch<boolean>(berlinDrivingPresenceQuery) ? null : berlinDrivingProject
  if (slug === sixSeasProject.slug) return await client.fetch<boolean>(sixSeasPresenceQuery) ? null : sixSeasProject
  return null
}

export async function getProjectSlugs() {
  const [slugs, cmsOwnsBerlin, cmsOwnsSixSeas] = await Promise.all([client.fetch<{slug: string}[]>(projectSlugsQuery), client.fetch<boolean>(berlinDrivingPresenceQuery), client.fetch<boolean>(sixSeasPresenceQuery)])
  return includeSixSeas(includeBerlinDriving(slugs, {slug: berlinDrivingProject.slug}, cmsOwnsBerlin), {slug: sixSeasProject.slug}, cmsOwnsSixSeas)
}

export async function getProjectNavigation() {
  const [projects, cmsOwnsBerlin, cmsOwnsSixSeas] = await Promise.all([client.fetch<ProjectNavItem[]>(projectNavQuery), client.fetch<boolean>(berlinDrivingPresenceQuery), client.fetch<boolean>(sixSeasPresenceQuery)])
  return includeSixSeas(includeBerlinDriving(projects, {slug: berlinDrivingProject.slug, title: berlinDrivingProject.title}, cmsOwnsBerlin), {slug: sixSeasProject.slug, title: sixSeasProject.title}, cmsOwnsSixSeas)
}

export function getResources() {
  return client.fetch<ProjectListItem[]>(resourcesQuery)
}

export function getResourceSlugs() {
  return client.fetch<{slug: string}[]>(resourceSlugsQuery)
}
