module.exports = {
  useFocusEffect: (fn) => fn && fn(),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), popToTop: jest.fn() }),
  useRoute: () => ({ params: {} }),
};
