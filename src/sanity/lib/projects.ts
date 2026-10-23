import {client} from './client'
import {includeOneFrame, oneFrameProject} from '@/content/one-frame'
import {berlinDrivingProject, includeBerlinDriving} from '@/content/berlin-driving-simulator'
import {
  matterReelProjectsQuery,
  projectBySlugQuery,
  projectNavQuery,
  projectSlugsQuery,
  projectsQuery,
  resourcesQuery,
  resourceSlugsQuery,
  oneFramePresenceQuery,
  berlinDrivingPresenceQuery,
} from './queries'
import type {Project, ProjectListItem, ProjectNavItem} from '../types'

export async function getProjects() {
  const [projects, cmsOwnsOneFrame, cmsOwnsBerlin] = await Promise.all([client.fetch<ProjectListItem[]>(projectsQuery), client.fetch<boolean>(oneFramePresenceQuery), client.fetch<boolean>(berlinDrivingPresenceQuery)])
  return includeBerlinDriving(includeOneFrame(projects, oneFrameProject, cmsOwnsOneFrame), berlinDrivingProject, cmsOwnsBerlin)
}

export function getMatterReelProjects(slugs: readonly string[]) {
  return client.fetch<ProjectListItem[]>(matterReelProjectsQuery, {slugs})
}

export async function getProjectBySlug(slug: string) {
  const project = await client.fetch<Project | null>(projectBySlugQuery, {slug})
  if (project) return project
  if (slug === oneFrameProject.slug) return await client.fetch<boolean>(oneFramePresenceQuery) ? null : oneFrameProject
  if (slug === berlinDrivingProject.slug) return await client.fetch<boolean>(berlinDrivingPresenceQuery) ? null : berlinDrivingProject
  return null
}

export async function getProjectSlugs() {
  const [slugs, cmsOwnsOneFrame, cmsOwnsBerlin] = await Promise.all([client.fetch<{slug: string}[]>(projectSlugsQuery), client.fetch<boolean>(oneFramePresenceQuery), client.fetch<boolean>(berlinDrivingPresenceQuery)])
  return includeBerlinDriving(includeOneFrame(slugs, {slug: oneFrameProject.slug}, cmsOwnsOneFrame), {slug: berlinDrivingProject.slug}, cmsOwnsBerlin).filter(p => p.slug !== 'time-frame')
}

export async function getProjectNavigation() {
  const [projects, cmsOwnsOneFrame, cmsOwnsBerlin] = await Promise.all([client.fetch<ProjectNavItem[]>(projectNavQuery), client.fetch<boolean>(oneFramePresenceQuery), client.fetch<boolean>(berlinDrivingPresenceQuery)])
  return includeBerlinDriving(includeOneFrame(projects, {slug: oneFrameProject.slug, title: oneFrameProject.title}, cmsOwnsOneFrame), {slug: berlinDrivingProject.slug, title: berlinDrivingProject.title}, cmsOwnsBerlin)
}

export function getResources() {
  return client.fetch<ProjectListItem[]>(resourcesQuery)
}

export function getResourceSlugs() {
  return client.fetch<{slug: string}[]>(resourceSlugsQuery)
}
