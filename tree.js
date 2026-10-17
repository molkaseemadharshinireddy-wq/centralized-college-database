const treeContainer = document.querySelector('#tree-container');
const treeSummary = document.querySelector('#tree-summary');
const treeToggle = document.querySelector('#tree-toggle');

function createTreeNode(name, className, detail) {
    const summary = document.createElement('summary');
    summary.className = `tree-node ${className}`;

    const label = document.createElement('span');
    label.className = 'tree-node-name';
    label.textContent = name;
    summary.append(label);

    if (detail) {
        const badge = document.createElement('span');
        badge.className = 'tree-badge';
        badge.textContent = detail;
        summary.append(badge);
    }

    return summary;
}

function renderTree(data) {
    if (!data || typeof data.name !== 'string' || !Array.isArray(data.children)) {
        throw new Error('The department data has an invalid structure.');
    }

    const departmentCount = data.children.length;
    const courseCount = data.children.reduce((total, department) => {
        if (!department || typeof department.name !== 'string' || !Array.isArray(department.children)) {
            throw new Error('A department is missing its name or course list.');
        }
        return total + department.children.length;
    }, 0);

    const tree = document.createElement('ul');
    tree.className = 'tree-list tree-root-list';

    const rootItem = document.createElement('li');
    rootItem.className = 'tree-item tree-root-item';
    const rootBranch = document.createElement('details');
    rootBranch.className = 'tree-branch tree-root-branch';
    rootBranch.open = true;
    rootBranch.append(createTreeNode(data.name, 'tree-node--college', `${departmentCount} departments`));

    const departmentList = document.createElement('ul');
    departmentList.className = 'tree-list tree-children';

    data.children.forEach((department) => {
        const departmentItem = document.createElement('li');
        departmentItem.className = 'tree-item';
        const departmentBranch = document.createElement('details');
        departmentBranch.className = 'tree-branch tree-department-branch';
        departmentBranch.open = true;
        departmentBranch.append(
            createTreeNode(
                department.name,
                'tree-node--department',
                `${department.children.length} ${department.children.length === 1 ? 'course' : 'courses'}`
            )
        );

        const courseList = document.createElement('ul');
        courseList.className = 'tree-list tree-courses';

        department.children.forEach((course) => {
            if (!course || typeof course.name !== 'string') {
                throw new Error(`A course in ${department.name} is missing its name.`);
            }

            const courseItem = document.createElement('li');
            courseItem.className = 'tree-item tree-course-item';
            const courseNode = document.createElement('div');
            courseNode.className = 'tree-node tree-node--course';

            const courseName = document.createElement('span');
            courseName.className = 'tree-node-name';
            courseName.textContent = course.name;
            courseNode.append(courseName);

            if (typeof course.duration === 'string' && course.duration.trim()) {
                const duration = document.createElement('span');
                duration.className = 'tree-badge tree-duration';
                duration.textContent = course.duration;
                courseNode.append(duration);
            }

            courseItem.append(courseNode);
            courseList.append(courseItem);
        });

        departmentBranch.append(courseList);
        departmentItem.append(departmentBranch);
        departmentList.append(departmentItem);
    });

    rootBranch.append(departmentList);
    rootItem.append(rootBranch);
    tree.append(rootItem);
    treeContainer.replaceChildren(tree);
    treeSummary.textContent = `${departmentCount} departments · ${courseCount} courses`;
    treeToggle.hidden = false;
    treeToggle.textContent = 'Collapse all';
}

function showError(error) {
    console.error('Could not load the department tree:', error);
    treeSummary.textContent = 'Department structure unavailable';

    const message = document.createElement('p');
    message.className = 'tree-message tree-error';
    message.textContent = 'The department structure could not be loaded. Check your connection and try again.';

    const retry = document.createElement('button');
    retry.className = 'tree-toggle';
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', loadTree, { once: true });

    treeContainer.replaceChildren(message, retry);
    treeToggle.hidden = true;
}

async function loadTree() {
    treeSummary.textContent = 'Loading departments…';
    treeContainer.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'tree-message',
        textContent: 'Loading the college structure…'
    }));

    try {
        const response = await fetch('departments.json');
        if (!response.ok) {
            throw new Error(`Department data request failed (${response.status}).`);
        }
        renderTree(await response.json());
    } catch (error) {
        showError(error);
    }
}

treeToggle.addEventListener('click', () => {
    const branches = treeContainer.querySelectorAll('details.tree-branch');
    const shouldExpand = Array.from(branches).some((branch) => !branch.open);
    branches.forEach((branch) => {
        branch.open = shouldExpand;
    });
    treeToggle.textContent = shouldExpand ? 'Collapse all' : 'Expand all';
});

loadTree();
