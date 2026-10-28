const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function render(tab = 'login') {
  const events = [];
  const jsx = (type, props) => ({ type, props: props || {} });
  const exports = {};
  const modules = {
    react: {
      useState: initial => [initial === 'login' ? tab : initial, value => events.push(value)],
      useRef: current => ({ current }), useEffect() {}, useCallback: fn => fn,
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': new Proxy({ StyleSheet: { create: value => value }, Platform: { OS: 'android' }, Keyboard: { dismiss() {} } }, { get: (target, key) => target[key] || key }),
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useRouter: () => ({ replace() {} }) },
    '@/contexts/AuthContext': { useAuth: () => ({ signUpWithDan: () => { throw new Error('DAN must not start on tab selection'); } }) },
    '@/contexts/ThemeContext': { useTheme: () => ({ colors: {} }) },
    'lucide-react-native': new Proxy({}, { get: (_, key) => key }),
    '@/lib/supabase': { supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { content: 'Synthetic terms' }, error: null }) }) }) }) } },
  };
  const source = fs.readFileSync('app/auth.tsx', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { exports, require: name => { assert.ok(modules[name], name); return modules[name]; }, setTimeout() {} });
  const tree = exports.default();
  const nodes = [];
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    nodes.push(node); visit(node.props?.children);
  };
  visit(tree);
  return { nodes, events, text: JSON.stringify(tree) };
}

test('login tab keeps password login and recovery, without duplicate legacy links', () => {
  const screen = render();
  assert.match(screen.text, /Нууц үг мартсан уу/);
  assert.equal(screen.nodes.filter(node => node.type === 'TextInput').length, 2);
  assert.doesNotMatch(screen.text, /Өмнөх Tureesly|Хуучин account|DAN-аар бүртгүүлэх/);
  const signupTab = screen.nodes.find(node => node.props.accessibilityRole === 'tab' && node.props.children.props.children === 'Бүртгүүлэх');
  signupTab.props.onPress();
  assert.deepEqual(screen.events, ['signup']);
});

test('signup tab shows explanation and opens terms before DAN, with no login fields', () => {
  const screen = render('signup');
  assert.equal(screen.nodes.filter(node => node.type === 'TextInput').length, 0);
  assert.match(screen.text, /DAN-аар бүртгүүлэх/);
  assert.match(screen.text, /нэвтрэх утас, нууц үгээ тохируулна/);
  const signupButton = screen.nodes.find(node => node.type === 'TouchableOpacity' && node.props.children?.props?.children === 'DAN-аар бүртгүүлэх');
  signupButton.props.onPress();
  assert.deepEqual(screen.events.slice(0, 2), [false, true]);
});
