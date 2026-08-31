import React, { useCallback } from 'react';
import { FlatList, Platform, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import type { RootStackParamList } from '../navigation/types';
import { PostCard } from '../components/PostCard';
import { ScreenState } from '../components/ScreenState';
import { useAppTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ContentList'>;

export function ContentListScreen({ route, navigation }: Props) {
  const theme = useAppTheme();
  const query = useQuery({
    queryKey: route.params.mode === 'posts' ? ['posts', 'mine'] : ['bookmarks'],
    queryFn: () =>
      route.params.mode === 'posts'
        ? api.listPosts({ mine: true })
        : api.myBookmarks(),
  });
  const openPost = useCallback(
    (postId: number) => {
      navigation.navigate('PostDetail', { postId });
    },
    [navigation],
  );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['bottom']}
    >
      {query.isLoading ? (
        <ScreenState loading />
      ) : query.isError ? (
        <ScreenState
          title="内容加载失败"
          message={(query.error as Error).message}
          actionLabel="重试"
          onAction={() => void query.refetch()}
        />
      ) : (
        <FlatList
          data={query.data?.items ?? []}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <PostCard post={item} onOpen={() => openPost(item.id)} />
          )}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
          initialNumToRender={5}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <ScreenState
              title={
                route.params.mode === 'posts'
                  ? '还没有发布过帖子'
                  : '还没有收藏'
              }
              message={
                route.params.mode === 'posts'
                  ? '去首页分享一条校园动态吧。'
                  : '收藏的帖子只对你自己可见。'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
