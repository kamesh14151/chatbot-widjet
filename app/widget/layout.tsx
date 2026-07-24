export default function WidgetLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<style>{`
					html, body {
						margin: 0;
						padding: 0;
						background: transparent !important;
						overflow: hidden;
					}
				`}</style>
			</head>
			<body style={{ background: 'transparent' }}>
				{children}
			</body>
		</html>
	);
}
