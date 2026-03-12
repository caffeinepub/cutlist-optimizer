import Map "mo:core/Map";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Data structures
  public type Sheet = {
    width : Float;
    height : Float;
    quantity : Nat;
    sheetLabel : Text;
  };

  public type Piece = {
    width : Float;
    height : Float;
    quantity : Nat;
    description : Text;
  };

  public type Project = {
    id : Text;
    name : Text;
    sheets : [Sheet];
    pieces : [Piece];
    createdAt : Time.Time;
    updatedAt : Time.Time;
  };

  public type UserProfile = {
    name : Text;
  };

  let projects = Map.empty<Principal, Map.Map<Text, Project>>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Helper functions for state modification (can only be used in shared functions)
  func getUserProjectsMut(user : Principal) : Map.Map<Text, Project> {
    switch (projects.get(user)) {
      case (null) {
        let newProjects = Map.empty<Text, Project>();
        projects.add(user, newProjects);
        newProjects;
      };
      case (?userProjects) { userProjects };
    };
  };

  // Helper function for read-only access (safe for query functions)
  func getUserProjectsReadOnly(user : Principal) : ?Map.Map<Text, Project> {
    projects.get(user);
  };

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // CRUD operations
  public shared ({ caller }) func createProject(name : Text, sheets : [Sheet], pieces : [Piece]) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create projects");
    };

    let timestamp = Time.now();
    let id = timestamp.toText();
    let project = {
      id;
      name;
      sheets;
      pieces;
      createdAt = timestamp;
      updatedAt = timestamp;
    };

    let userProjects = getUserProjectsMut(caller);
    userProjects.add(id, project);

    id;
  };

  public query ({ caller }) func getProject(projectId : Text) : async Project {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view projects");
    };

    switch (getUserProjectsReadOnly(caller)) {
      case (null) { Runtime.trap("Project not found") };
      case (?userProjects) {
        switch (userProjects.get(projectId)) {
          case (null) { Runtime.trap("Project not found") };
          case (?project) { project };
        };
      };
    };
  };

  public shared ({ caller }) func updateProject(projectId : Text, name : Text, sheets : [Sheet], pieces : [Piece]) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update projects");
    };

    let userProjects = getUserProjectsMut(caller);
    switch (userProjects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?existingProject) {
        let updatedProject = {
          existingProject with
          name;
          sheets;
          pieces;
          updatedAt = Time.now();
        };
        userProjects.add(projectId, updatedProject);
      };
    };
  };

  public shared ({ caller }) func deleteProject(projectId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete projects");
    };

    let userProjects = getUserProjectsMut(caller);
    if (not userProjects.containsKey(projectId)) {
      Runtime.trap("Project not found");
    };
    userProjects.remove(projectId);
  };

  public query ({ caller }) func getAllProjects() : async [Project] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list projects");
    };

    switch (getUserProjectsReadOnly(caller)) {
      case (null) { [] };
      case (?userProjects) {
        userProjects.values().toArray();
      };
    };
  };

  public query ({ caller }) func projectExists(projectId : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can check project existence");
    };

    switch (getUserProjectsReadOnly(caller)) {
      case (null) { false };
      case (?userProjects) {
        userProjects.containsKey(projectId);
      };
    };
  };

  // Admin functions
  public query ({ caller }) func getUserProjectsAdmin(user : Principal) : async [Project] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view other users' projects");
    };

    switch (getUserProjectsReadOnly(user)) {
      case (null) { [] };
      case (?userProjects) {
        userProjects.values().toArray();
      };
    };
  };

  public query ({ caller }) func countProjects() : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can count all projects");
    };

    var total : Nat = 0;
    for ((user, userProjects) in projects.entries()) {
      total += userProjects.size();
    };
    total;
  };

  public query ({ caller }) func getAllProjectsAdmin() : async [(Principal, Project)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all projects");
    };

    var result : [(Principal, Project)] = [];
    for ((user, userProjects) in projects.entries()) {
      for ((id, project) in userProjects.entries()) {
        result := result.concat([(user, project)]);
      };
    };
    result;
  };

  public shared ({ caller }) func clearUserData() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can clear their own data");
    };

    projects.remove(caller);
  };
};
