import React, {useState} from 'react';
import {FlatList, Pressable, StyleSheet, TextInput, View} from 'react-native';
import {Search, X} from '../components/AliIcon';
import {useQuery} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api} from '../api/client';
import type {RootStackParamList} from '../navigation/types';
import {PostCard} from '../components/PostCard';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

export function SearchScreen({navigation}: Props) {
  const theme = useAppTheme();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const results = useQuery({queryKey: ['search', query], queryFn: () => api.listPosts({q: query}), enabled: query.length > 0});

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['bottom']}>
      <View style={[styles.searchBar, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]}>
        <Search size={20} color={theme.colors.textSecondary} />
        <TextInput
          autoFocus
          accessibilityLabel="搜索帖子和标签"
          returnKeyType="search"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => setQuery(input.trim())}
          placeholder="搜索帖子正文或标签"
          placeholderTextColor={theme.colors.textSecondary}
          style={[styles.input, {color: theme.colors.text}]}
        />
        {input ? <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" hitSlop={10} onPress={() => {setInput(''); setQuery('');}} style={styles.clear}><X size={19} color={theme.colors.textSecondary} /></Pressable> : null}
      </View>
      {!query ? <ScreenState title="搜索校园动态" message="输入正文关键词或标签名称，然后点击键盘上的“搜索”。" /> : results.isLoading ? <ScreenState loading /> : results.isError ? (
        <ScreenState title="搜索失败" message={(results.error as Error).message} actionLabel="重试" onAction={() => void results.refetch()} />
      ) : (
        <FlatList
          data={results.data?.items ?? []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => <PostCard post={item} onOpen={() => navigation.navigate('PostDetail', {postId: item.id})} />}
          contentContainerStyle={styles.results}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={<ScreenState title="没有找到相关帖子" message="换一个关键词或更短的标签试试。" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  searchBar: {height: 50, borderWidth: 1, borderRadius: radius.pill, marginHorizontal: spacing.md, marginTop: 10, marginBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9},
  input: {flex: 1, height: 48, fontSize: 16, paddingVertical: 0},
  clear: {width: 36, height: 44, alignItems: 'center', justifyContent: 'center'},
  results: {paddingTop: 4, paddingBottom: 40},
});
