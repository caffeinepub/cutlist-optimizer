import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Piece {
    height: number;
    description: string;
    quantity: bigint;
    width: number;
}
export type Time = bigint;
export interface Project {
    id: string;
    sheets: Array<Sheet>;
    name: string;
    createdAt: Time;
    pieces: Array<Piece>;
    updatedAt: Time;
}
export interface UserProfile {
    name: string;
}
export interface Sheet {
    height: number;
    sheetLabel: string;
    quantity: bigint;
    width: number;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    clearUserData(): Promise<void>;
    countProjects(): Promise<bigint>;
    createProject(name: string, sheets: Array<Sheet>, pieces: Array<Piece>): Promise<string>;
    deleteProject(projectId: string): Promise<void>;
    getAllProjects(): Promise<Array<Project>>;
    getAllProjectsAdmin(): Promise<Array<[Principal, Project]>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getProject(projectId: string): Promise<Project>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getUserProjectsAdmin(user: Principal): Promise<Array<Project>>;
    isCallerAdmin(): Promise<boolean>;
    projectExists(projectId: string): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateProject(projectId: string, name: string, sheets: Array<Sheet>, pieces: Array<Piece>): Promise<void>;
}
