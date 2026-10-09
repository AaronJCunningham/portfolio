import {client} from './client'
import {
  matterReelProjectsQuery,
  projectBySlugQuery,
  projectNavQuery,
  projectSlugsQuery,
  projectsQuery,
  resourcesQuery,
  resourceSlugsQuery,
} from './queries'
import type {Project, ProjectListItem, ProjectNavItem} from '../types'

export function getProjects() {
  return client.fetch<ProjectListItem[]>(projectsQuery)
}

export function getMatterReelProjects(slugs: readonly string[]) {
  return client.fetch<ProjectListItem[]>(matterReelProjectsQuery, {slugs})
}

export function getProjectBySlug(slug: string) {
  return client.fetch<Project | null>(projectBySlugQuery, {slug})
}

export function getProjectSlugs() {
  return client.fetch<{slug: string}[]>(projectSlugsQuery)
}

export function getProjectNavigation() {
  return client.fetch<ProjectNavItem[]>(projectNavQuery)
}

export function getResources() {
  return client.fetch<ProjectListItem[]>(resourcesQuery)
}

export function getResourceSlugs() {
  return client.fetch<{slug: string}[]>(resourceSlugsQuery)
}
