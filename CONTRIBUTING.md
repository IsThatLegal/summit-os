# Contributing to SummitOS

We welcome contributions to SummitOS! This document provides guidelines for contributing to the project.

## 🤝 How to Contribute

### 1. Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/summit-os.git
   cd summit-os
   ```
3. **Set up the development environment** following the [SETUP.md](./SETUP.md) guide
4. **Create a new branch** for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### 2. Making Changes

#### Code Style
- Follow existing code patterns and conventions
- Use TypeScript for all new code
- Add proper type annotations
- Write meaningful commit messages

#### Testing
- **All new features must include tests**
- Run the test suite before committing:
  ```bash
  npm test                    # Unit/integration tests
  npm run test:e2e           # E2E tests
  npm run lint               # Linting
  ```
- Ensure all tests pass

#### Documentation
- Update relevant documentation files
- Add comments for complex logic
- Update API documentation if needed

### 3. Submitting Changes

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request**:
   - Provide a clear description of changes
   - Link any relevant issues
   - Include screenshots for UI changes
   - Ensure CI checks pass

## 📝 Commit Message Guidelines

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples:
```
feat(dashboard): add payment processing modal
fix(gate): resolve tenant UUID validation issue
docs(readme): update installation instructions
test(e2e): add payment flow test coverage
```

## 🧪 Testing Guidelines

### Unit/Integration Tests
- Test all new functions and components
- Mock external dependencies
- Test error cases and edge cases
- Aim for high code coverage

### E2E Tests
- Test user workflows end-to-end
- Use Playwright for browser automation
- Test across multiple browsers
- Include accessibility testing

### Test Structure
```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests
```

## 🏗️ Development Workflow

### 1. Issue Creation
- Create an issue for bugs or feature requests
- Provide detailed description and reproduction steps
- Label appropriately (bug, enhancement, etc.)

### 2. Development
- Assign issue to yourself
- Create feature branch from `main`
- Implement changes with tests
- Update documentation

### 3. Review Process
- Submit pull request for review
- Address feedback from maintainers
- Ensure all checks pass
- Merge after approval

## 📁 Project Structure

```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── dashboard/         # Main dashboard
│   └── gate-simulator/    # Gate testing interface
├── components/            # React components
├── lib/                   # Shared utilities
├── scripts/               # Hardware integration scripts
├── supabase/             # Database migrations and seeds
├── tests/                # Test files
├── e2e/                  # Playwright e2e tests
└── docs/                 # Documentation
```

## 🐛 Bug Reports

When reporting bugs, include:

1. **Environment Details**:
   - OS and version
   - Node.js version
   - Browser version (if applicable)

2. **Steps to Reproduce**:
   - Clear, numbered steps
   - Expected vs actual behavior
   - Error messages and screenshots

3. **Additional Context**:
   - Related issues or PRs
   - Possible solutions you've tried

## 💡 Feature Requests

For feature requests:

1. **Use the feature request template**
2. **Describe the problem** you're trying to solve
3. **Propose a solution** with use cases
3. **Consider alternatives** and trade-offs
4. **Break down large features** into smaller PRs

## 🔧 Development Tools

### Recommended VS Code Extensions
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Prettier - Code formatter
- ESLint
- Playwright Test for VSCode

### Useful Commands
```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Testing
npm test                 # Run unit/integration tests
npm run test:e2e         # Run E2E tests
npm run lint             # Run linter

# Database
npx supabase db push     # Apply migrations
npx supabase db seed     # Seed database
```

## 📋 Code Review Checklist

### Before Submitting PR
- [ ] Code follows project conventions
- [ ] All tests pass
- [ ] New features have tests
- [ ] Documentation is updated
- [ ] No console.log statements
- [ ] No commented-out code
- [ ] Types are properly defined

### During Review
- [ ] Code is readable and maintainable
- [ ] Logic is correct and efficient
- [ ] Security considerations are addressed
- [ ] Performance implications are considered
- [ ] Error handling is appropriate

## 🚀 Release Process

1. **Version bump** in package.json
2. **Update CHANGELOG.md** with changes
3. **Create Git tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. **Deploy to production**
5. **Announce release** with notes

## 📞 Getting Help

1. **Check existing documentation**:
   - [README.md](./README.md)
   - [SETUP.md](./SETUP.md)
   - [ROADMAP.md](./ROADMAP.md)

2. **Search existing issues** before creating new ones

3. **Join discussions**:
   - GitHub Discussions
   - Community channels (if available)

4. **Contact maintainers** for critical issues

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to SummitOS! 🎉