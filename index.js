"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));

const defaultIssueMessage = "Hi @{{name}}! Thanks for bringing this issue to the community's attention. This community welcomes you and looks forward to looking at your issue. In the mean feel free to join our Slack community for more updates.";
const defaultPrMessage = "Hi @{{name}}! Congrats on making your first pull request. The *insert repo name* community welcomes you and looks forward to looking at your contribution. In the meantime, please sign the CLA linked below and if you’d like, take a look at this file written for newer contributors.";

function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let issueMessage = core.getInput('issue-message');
            let prMessage = core.getInput('pr-message');
            
            // Get client and context
            const client = new github.GitHub(core.getInput('repo-token', { required: true }));
            const context = github.context;
            if (context.payload.action !== 'opened') {
                console.log('No issue or PR was opened, skipping');
                return;
            }
            // Do nothing if its not a pr or issue
            const isIssue = context.payload.issue;
            const isPr = context.payload.pull_request;
            if (!isIssue && !isPr) {
                console.log('The event that triggered this action was not a pull request or issue, skipping.');
                return;
            }
            // Do nothing if its not their first contribution
            console.log('Checking if its the users first contribution');
            if (!context.payload.sender) {
                throw new Error('Internal error, no sender provided by GitHub');
            }
            const sender = context.payload.sender.login;
            console.log("login is: ", sender);
            if (!prMessage) {
              prMessage = defaultPrMessage;
              prMessage = prMessage.replace("{{name}}", sender);
            }
            if (!issueMessage) {
              issueMessage = defaultIssueMessage;
              issueMessage = issueMessage.replace("{{name}}", sender);
            }
            
            const issue = context.issue;
            let firstContribution = false;
            if (isIssue) {
                firstContribution = yield isFirstIssue(client, issue.owner, issue.repo, sender, issue.number);
            }
            else {
                firstContribution = yield isFirstPull(client, issue.owner, issue.repo, sender, issue.number);
            }
            // TODO - still commenting if not first contribution - but logging in console
            if (!firstContribution) {
                console.log('Not the users first contribution, but will continue');
                //return;
            }
            // Do nothing if no message set for this type of contribution
            const message = isIssue ? issueMessage : prMessage;
            if (!message) {
                console.log('No message provided for this type of contribution');
                return;
            }
            const issueType = isIssue ? 'issue' : 'pull request';
            // Add a comment to the appropriate place
            console.log(`Adding message: ${message} to ${issueType} ${issue.number}`);
            if (isIssue) {
                yield client.issues.createComment({
                    owner: issue.owner,
                    repo: issue.repo,
                    issue_number: issue.number,
                    body: message
                });
            }
            else {
                yield client.pulls.createReview({
                    owner: issue.owner,
                    repo: issue.repo,
                    pull_number: issue.number,
                    body: message,
                    event: 'COMMENT'
                });
            }
            console.log("context is: ", context);

        }
        catch (error) {
            core.setFailed(error.message);
            return;
        }
    });
}
function isFirstIssue(client, owner, repo, sender, curIssueNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const { status, data: issues } = yield client.issues.listForRepo({
            owner: owner,
            repo: repo,
            creator: sender,
            state: 'all'
        });
        if (status !== 200) {
            throw new Error(`Received unexpected API status code ${status}`);
        }
        if (issues.length === 0) {
            return true;
        }
        for (const issue of issues) {
            if (issue.number < curIssueNumber && !issue.pull_request) {
                return false;
            }
        }
        return true;
    });
}
// No way to filter pulls by creator
function isFirstPull(client, owner, repo, sender, curPullNumber, page = 1) {
    return __awaiter(this, void 0, void 0, function* () {
        // Provide console output if we loop for a while.
        console.log('Checking...');
        const { status, data: pulls } = yield client.pulls.list({
            owner: owner,
            repo: repo,
            per_page: 100,
            page: page,
            state: 'all'
        });
        if (status !== 200) {
            throw new Error(`Received unexpected API status code ${status}`);
        }
        if (pulls.length === 0) {
            return true;
        }
        for (const pull of pulls) {
            const login = pull.user.login;
            if (login === sender && pull.number < curPullNumber) {
                return false;
            }
        }
        return yield isFirstPull(client, owner, repo, sender, curPullNumber, page + 1);
    });
}
run();
