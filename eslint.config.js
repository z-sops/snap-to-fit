const {defineConfig}=require('eslint/config');
const expo=require('eslint-config-expo/flat');
module.exports=defineConfig([expo,{ignores:['src/components/movement-html.ts','dist/**','node_modules/**']},{rules:{'react-hooks/exhaustive-deps':'warn'}}]);
