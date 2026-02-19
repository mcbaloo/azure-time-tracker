const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: {
        'time-entry/time-entry': './src/time-entry/time-entry.ts',
        'reports/reports': './src/reports/reports.ts',
        'time-summary/time-summary': './src/time-summary/time-summary.ts'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: 'src/time-entry/*.html', to: 'time-entry/[name][ext]' },
                { from: 'src/reports/*.html', to: 'reports/[name][ext]' },
                { from: 'src/time-summary/*.html', to: 'time-summary/[name][ext]' },
                { from: 'src/shared/*.css', to: 'shared/[name][ext]' },
                { from: 'images', to: 'images' }
            ]
        })
    ],
    mode: 'production',
    devtool: 'source-map'
};
