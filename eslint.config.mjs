import nextVitals from 'eslint-config-next/core-web-vitals'

export default [
  ...nextVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      // Preserve the pre-upgrade lint policy for imperative Three.js scenes.
      // React Compiler is not enabled; adopting these new checks is separate work.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]
