export type RootStackParamList = {
  MainTabs: undefined;
  PostDetail: {postId: number};
  Search: undefined;
  Chat: {conversationId: number; title: string};
  ContentList: {mode: 'posts' | 'bookmarks'; title: string};
  EditProfile: undefined;
  Verification: undefined;
  AccountSettings: undefined;
  AI: undefined;
  Announcements: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Tools: undefined;
  Compose: undefined;
  Messages: undefined;
  Profile: undefined;
};
