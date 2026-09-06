import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from './card'
import { Button } from './button'

const meta = {
  title: 'UI/Card',
  component: Card,
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Blood test — 12 Mar 2026</CardTitle>
        <CardDescription>Uploaded by Aparna</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>Complete blood count, as written on the report.</p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Download
        </Button>
      </CardFooter>
    </Card>
  ),
}

export const Compact: Story = {
  render: (args) => (
    <Card {...args} size="sm">
      <CardHeader>
        <CardTitle>Prescription</CardTitle>
        <CardDescription>Date unknown</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Amoxicillin 500mg, as written.</p>
      </CardContent>
    </Card>
  ),
}
